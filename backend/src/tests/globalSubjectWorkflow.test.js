require("dotenv").config();
const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../app");
const Class = require("../models/Class");
const GlobalSubject = require("../models/GlobalSubject");
const Examination = require("../models/Examination");
const Submission = require("../models/Submission");
const ExamResult = require("../models/ExamResult");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { generateAuthToken } = require("../utils/tokens");

test("global subject updates preserve class choices and historical examination snapshots", async (t) => {
  assert.ok(
    process.env.MONGODB_URI,
    "MONGODB_URI is required for this integration test",
  );
  process.env.JWT_SECRET ||= "global-subject-integration-test-secret";
  await mongoose.connect(process.env.MONGODB_URI);

  const suffix = `Global Subject Integration ${new mongoose.Types.ObjectId()}`;
  const admin = await User.create({
    name: "Global Subject Integration Admin",
    email: `${new mongoose.Types.ObjectId()}@integration.invalid`,
    passwordHash: "not-used-in-this-test",
    role: "admin",
  });
  const nonAdminId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: nonAdminId,
    name: "Global Subject Integration Teacher",
    email: `${new mongoose.Types.ObjectId()}@integration.invalid`,
    passwordHash: "not-used-in-this-test",
    role: "teacher",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const subject = await GlobalSubject.create({
    name: suffix,
    identityKey: `integration:${new mongoose.Types.ObjectId()}`,
    defaultTotalMarks: 100,
    defaultPassingMarks: 33,
  });
  const classes = await Promise.all(
    [33, 35, 33].map((passingMarks, index) =>
      Class.create({
        name: `${suffix} Class ${index + 1}`,
        academicSession: "integration",
        createdBy: admin._id,
        subjects: [
          {
            name: suffix,
            globalSubject: subject._id,
            totalMarks: 100,
            passingMarks,
          },
        ],
      }),
    ),
  );
  const classSubjectIds = classes.map((klass) => klass.subjects[0]._id);
  const initialExam = await Examination.create({
    name: `${suffix} Historical Exam`,
    class: classes[0]._id,
    academicSession: "integration",
    resultDate: new Date(),
    status: "finalized",
    subjects: [
      {
        subject: classSubjectIds[0],
        globalSubject: subject._id,
        name: suffix,
        totalMarks: 100,
        passingMarks: 33,
      },
    ],
    createdBy: admin._id,
  });
  await Submission.create({
    examination: initialExam._id,
    subject: classSubjectIds[0],
    subjectName: suffix,
    teacherName: "Integration Teacher",
    totalLecturesDelivered: 1,
    entries: [],
  });
  await ExamResult.create({
    examination: initialExam._id,
    students: [],
    finalizedBy: admin._id,
  });

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = generateAuthToken(admin);
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token === false
          ? {}
          : { Authorization: `Bearer ${adminToken}` }),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };

  t.after(async () => {
    server.close();
    await Promise.all([
      AuditLog.deleteMany({ user: admin._id }),
      ExamResult.deleteMany({ examination: initialExam._id }),
      Submission.deleteMany({ examination: initialExam._id }),
      Examination.deleteMany({
        class: { $in: classes.map((klass) => klass._id) },
      }),
      Class.deleteMany({ _id: { $in: classes.map((klass) => klass._id) } }),
      GlobalSubject.deleteOne({ _id: subject._id }),
      User.deleteOne({ _id: admin._id }),
      User.collection.deleteOne({ _id: nonAdminId }),
    ]);
    await mongoose.disconnect();
  });

  const unauthorized = await request("/global-subjects/apply", {
    method: "POST",
    token: false,
    body: { subjectId: subject._id, classSubjectIds: [classSubjectIds[0]] },
  });
  assert.equal(unauthorized.status, 401);
  const forbidden = await fetch(`${baseUrl}/global-subjects/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${generateAuthToken({ _id: nonAdminId, role: "teacher" })}`,
    },
    body: JSON.stringify({
      subjectId: subject._id,
      classSubjectIds: [classSubjectIds[0]],
    }),
  });
  assert.equal(forbidden.status, 403);

  const invalidMarks = await request(
    `/global-subjects/${subject._id}/defaults`,
    {
      method: "PUT",
      body: { totalMarks: 10, passingMarks: 11 },
    },
  );
  assert.equal(invalidMarks.status, 400);

  const defaults = await request(`/global-subjects/${subject._id}/defaults`, {
    method: "PUT",
    body: { name: suffix, totalMarks: 100, passingMarks: 40 },
  });
  assert.equal(defaults.status, 200);
  assert.equal(
    (await Class.findById(classes[0]._id)).subjects[0].passingMarks,
    33,
  );

  assert.equal(
    await Examination.countDocuments({
      class: classes[0]._id,
      "subjects.subject": classSubjectIds[0],
    }),
    1,
  );
  const requiresAcknowledgement = await request("/global-subjects/apply", {
    method: "POST",
    body: {
      subjectId: subject._id,
      classSubjectIds: [classSubjectIds[0]],
      overwriteDifferentClassSubjectIds: [classSubjectIds[0]],
    },
  });
  assert.equal(
    requiresAcknowledgement.status,
    409,
    JSON.stringify(requiresAcknowledgement.body),
  );
  assert.equal(
    (await Class.findById(classes[0]._id)).subjects[0].passingMarks,
    33,
  );

  const skippedDifferentScheme = await request("/global-subjects/apply", {
    method: "POST",
    body: { subjectId: subject._id, classSubjectIds: [classSubjectIds[0]] },
  });
  assert.equal(skippedDifferentScheme.status, 200);
  assert.equal(skippedDifferentScheme.body.data.summary.skipped, 1);
  assert.equal(skippedDifferentScheme.body.data.summary.successful, 0);

  const firstApply = await request("/global-subjects/apply", {
    method: "POST",
    body: {
      subjectId: subject._id,
      classSubjectIds: [classSubjectIds[0]],
      overwriteDifferentClassSubjectIds: [classSubjectIds[0]],
      acknowledgeExistingExams: true,
    },
  });
  assert.equal(firstApply.status, 200);
  assert.equal(firstApply.body.data.summary.successful, 1);
  assert.equal(
    (await Class.findById(classes[0]._id)).subjects[0].passingMarks,
    40,
  );

  const newDefaults = await request(
    `/global-subjects/${subject._id}/defaults`,
    {
      method: "PUT",
      body: { name: suffix, totalMarks: 120, passingMarks: 50 },
    },
  );
  assert.equal(newDefaults.status, 200);
  const multiApply = await request("/global-subjects/apply", {
    method: "POST",
    body: {
      subjectId: subject._id,
      classSubjectIds: [classSubjectIds[0], classSubjectIds[1]],
      overwriteDifferentClassSubjectIds: [
        classSubjectIds[0],
        classSubjectIds[1],
      ],
      acknowledgeExistingExams: true,
    },
  });
  assert.equal(multiApply.status, 200);
  assert.equal(multiApply.body.data.summary.successful, 2);
  assert.deepEqual(
    (await Class.findById(classes[2]._id)).subjects[0].toObject(),
    classes[2].subjects[0].toObject(),
  );

  const historical = await Examination.findById(initialExam._id);
  const historicalResult = await ExamResult.findOne({
    examination: initialExam._id,
  });
  assert.equal(historical.subjects[0].totalMarks, 100);
  assert.equal(historical.subjects[0].passingMarks, 33);
  assert.equal(historicalResult.students.length, 0);
  assert.equal(
    await Submission.countDocuments({ examination: initialExam._id }),
    1,
  );

  const futureExam = await request("/examinations", {
    method: "POST",
    body: {
      name: `${suffix} Future Exam`,
      class: classes[0]._id,
      academicSession: "integration",
      resultDate: new Date().toISOString(),
      subjectIds: [classSubjectIds[0]],
    },
  });
  assert.equal(futureExam.status, 201);
  assert.equal(futureExam.body.data.subjects[0].totalMarks, 120);
  assert.equal(futureExam.body.data.subjects[0].passingMarks, 50);

  const copiedPrevious = await request(
    `/examinations/${initialExam._id}/create-from-previous`,
    {
      method: "POST",
      body: { name: `${suffix} Copied`, resultDate: new Date().toISOString() },
    },
  );
  const copiedLatest = await request(
    `/examinations/${initialExam._id}/create-from-previous`,
    {
      method: "POST",
      body: {
        name: `${suffix} Latest`,
        resultDate: new Date().toISOString(),
        configurationSource: "latest",
      },
    },
  );
  assert.equal(copiedPrevious.status, 201);
  assert.equal(copiedPrevious.body.data.subjects[0].passingMarks, 33);
  assert.equal(copiedLatest.status, 201);
  assert.equal(copiedLatest.body.data.subjects[0].passingMarks, 50);

  const audit = await AuditLog.find({ user: admin._id }).sort({ createdAt: 1 });
  assert.ok(audit.some((entry) => entry.action === "global_subject_updated"));
  assert.ok(
    audit.some((entry) => entry.action === "subject_configurations_applied"),
  );
  const subjectAudit = audit.filter((entry) =>
    ["global_subject_updated", "subject_configurations_applied"].includes(
      entry.action,
    ),
  );
  assert.ok(subjectAudit.length >= 3);
  assert.ok(subjectAudit.every((entry) => entry.userLabel === admin.name));
  assert.ok(
    subjectAudit
      .filter((entry) => entry.action === "subject_configurations_applied")
      .every((entry) => entry.metadata.affectedConfigurations?.length > 0),
  );
});
