require("dotenv").config();
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Class = require("../models/Class");
const GlobalSubject = require("../models/GlobalSubject");
const Examination = require("../models/Examination");
const Submission = require("../models/Submission");
const ExamResult = require("../models/ExamResult");
const AuditLog = require("../models/AuditLog");
const { generateAuthToken } = require("../utils/tokens");
const { EXAM_STATUS, AUDIT_ACTIONS } = require("../config/constants");

describe("Universal Subject Management Integration Tests", () => {
  let server;
  let baseUrl;
  let admin;
  let adminToken;
  const testIds = [];

  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token === false ? {} : { Authorization: `Bearer ${adminToken}` }),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  };

  before(async () => {
    assert.ok(process.env.MONGODB_URI, "MONGODB_URI is required");
    process.env.JWT_SECRET ||= "test-jwt-secret-universal-subject";
    await mongoose.connect(process.env.MONGODB_URI);

    admin = await User.create({
      name: "Subject Test Admin",
      email: `subject_admin_${Date.now()}@college.edu`,
      passwordHash: "not-used",
      role: "admin",
    });
    adminToken = generateAuthToken(admin);

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    if (server) server.close();
    if (testIds.length > 0) {
      await Promise.all([
        Class.deleteMany({ _id: { $in: testIds } }),
        Examination.deleteMany({ class: { $in: testIds } }),
        GlobalSubject.deleteMany({ name: /^TEST_/ }),
        AuditLog.deleteMany({ user: admin._id }),
        User.deleteOne({ _id: admin._id }),
      ]);
    } else {
      await User.deleteOne({ _id: admin._id });
    }
    await mongoose.disconnect();
  });

  test("1. Create global English and prevent duplicates", async () => {
    const res = await request("/global-subjects", {
      method: "POST",
      body: {
        name: "TEST_English",
        code: "TEST_ENG",
        totalMarks: 20,
        passingMarks: 8,
      },
    });

    assert.equal(res.status, 201, `Failed to create: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.data.name, "TEST_English");
    assert.equal(res.body.data.totalMarks, 20);
    assert.equal(res.body.data.passingMarks, 8);
    assert.equal(res.body.data.code, "TEST_ENG");

    const duplicateRes = await request("/global-subjects", {
      method: "POST",
      body: {
        name: "TEST_English",
        code: "TEST_ENG",
        totalMarks: 25,
        passingMarks: 10,
      },
    });
    assert.equal(duplicateRes.status, 400, "Should reject duplicate global subject");
  });

  test("2. Attach English to multiple classes and inherit global values", async () => {
    // Fetch the global subject
    const listRes = await request("/global-subjects?search=TEST_English");
    assert.equal(listRes.status, 200);
    const globalEnglish = listRes.body.data.find((s) => s.name === "TEST_English");
    assert.ok(globalEnglish, "TEST_English must exist");

    // Class A, Class B, Class C, Class D
    const createdClasses = [];
    for (const name of ["Class A", "Class B", "Class C", "Class D"]) {
      const classRes = await request("/classes", {
        method: "POST",
        body: {
          name: `TEST_${name}`,
          academicSession: "2026-27",
          subjects: [
            {
              globalSubjectId: globalEnglish._id,
              name: globalEnglish.name,
              code: globalEnglish.code,
              totalMarks: 20,
              passingMarks: 8,
              inheritsGlobalConfig: true,
            },
          ],
        },
      });
      assert.equal(classRes.status, 201);
      createdClasses.push(classRes.body.data);
      testIds.push(classRes.body.data._id);
    }

    // Verify all 4 inherit
    for (const c of createdClasses) {
      assert.equal(c.subjects[0].totalMarks, 20);
      assert.equal(c.subjects[0].passingMarks, 8);
      assert.equal(c.subjects[0].inheritsGlobalConfig, true);
    }
  });

  test("3. Override English in Class C", async () => {
    const classC = await Class.findOne({ name: "TEST_Class C" });
    assert.ok(classC);
    const subjectId = classC.subjects[0]._id;

    // Class C overrides to 25 / 10
    const updateRes = await request(`/classes/${classC._id}/subjects/${subjectId}`, {
      method: "PUT",
      body: {
        totalMarks: 25,
        passingMarks: 10,
      },
    });
    assert.equal(updateRes.status, 200);

    const refreshedC = await Class.findById(classC._id);
    assert.equal(refreshedC.subjects[0].totalMarks, 25);
    assert.equal(refreshedC.subjects[0].passingMarks, 10);
    assert.equal(refreshedC.subjects[0].inheritsGlobalConfig, false, "Class C should now have override = true (inheritsGlobalConfig = false)");
  });

  test("4. Update global English (20/8 -> 30/10) and verify inheritance & override preservation", async () => {
    const globalEnglish = await GlobalSubject.findOne({ name: "TEST_English" });
    assert.ok(globalEnglish);

    const updateRes = await request(`/global-subjects/${globalEnglish._id}`, {
      method: "PUT",
      body: {
        totalMarks: 30,
        passingMarks: 10,
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.summary.overridesPreserved, 1, "Should preserve 1 override");

    // Check Class A (inherits -> 30 / 10)
    const classA = await Class.findOne({ name: "TEST_Class A" });
    assert.equal(classA.subjects[0].totalMarks, 30);
    assert.equal(classA.subjects[0].passingMarks, 10);
    assert.equal(classA.subjects[0].inheritsGlobalConfig, true);

    // Check Class B (inherits -> 30 / 10)
    const classB = await Class.findOne({ name: "TEST_Class B" });
    assert.equal(classB.subjects[0].totalMarks, 30);
    assert.equal(classB.subjects[0].passingMarks, 10);

    // Check Class C (override -> remains 25 / 10)
    const classC = await Class.findOne({ name: "TEST_Class C" });
    assert.equal(classC.subjects[0].totalMarks, 25, "Override in Class C must remain 25");
    assert.equal(classC.subjects[0].passingMarks, 10, "Override in Class C must remain 10");
    assert.equal(classC.subjects[0].inheritsGlobalConfig, false);

    // Check Class D (inherits -> 30 / 10)
    const classD = await Class.findOne({ name: "TEST_Class D" });
    assert.equal(classD.subjects[0].totalMarks, 30);
    assert.equal(classD.subjects[0].passingMarks, 10);
  });

  test("5. Create examination using English, finalize, update global subject, verify historical exam remains unchanged", async () => {
    const classA = await Class.findOne({ name: "TEST_Class A" });
    const globalEnglish = await GlobalSubject.findOne({ name: "TEST_English" });

    // Exam created when Class A has 30 / 10
    const examRes = await request("/examinations", {
      method: "POST",
      body: {
        name: "TEST_Exam 1",
        examType: "Monthly Test",
        class: classA._id,
        academicSession: classA.academicSession,
        resultDate: new Date().toISOString(),
        subjectIds: [classA.subjects[0]._id],
      },
    });
    assert.equal(examRes.status, 201);
    const examId = examRes.body.data._id;

    // Simulate teacher submission
    await Submission.create({
      examination: examId,
      subject: classA.subjects[0]._id,
      subjectName: classA.subjects[0].name,
      teacherName: "Prof. John",
      totalLecturesDelivered: 10,
      entries: [],
    });

    // Finalize exam
    const finalizeRes = await request(`/results/${examId}/finalize`, { method: "POST" });
    assert.equal(finalizeRes.status, 200);

    // Now update Global English to 50 / 20
    const updateRes = await request(`/global-subjects/${globalEnglish._id}`, {
      method: "PUT",
      body: {
        totalMarks: 50,
        passingMarks: 20,
      },
    });
    assert.equal(updateRes.status, 200);

    // Verify Class A was updated to 50 / 20
    const refreshedClassA = await Class.findById(classA._id);
    assert.equal(refreshedClassA.subjects[0].totalMarks, 50);
    assert.equal(refreshedClassA.subjects[0].passingMarks, 20);

    // CRITICAL: Finalized Exam must still have 30 / 10
    const refreshedExam = await Examination.findById(examId);
    assert.equal(refreshedExam.status, EXAM_STATUS.FINALIZED);
    assert.equal(refreshedExam.subjects[0].totalMarks, 30, "Historical exam snapshot totalMarks must remain 30");
    assert.equal(refreshedExam.subjects[0].passingMarks, 10, "Historical exam snapshot passingMarks must remain 10");

    // Clean up exam
    await Submission.deleteMany({ examination: examId });
    await ExamResult.deleteMany({ examination: examId });
    await Examination.deleteOne({ _id: examId });
  });

  test("6. Verify audit logs were properly recorded", async () => {
    const logs = await AuditLog.find({ user: admin._id });
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes(AUDIT_ACTIONS.GLOBAL_SUBJECT_CREATED), "Must log global subject creation");
    assert.ok(actions.includes(AUDIT_ACTIONS.GLOBAL_SUBJECT_UPDATED), "Must log global subject update");
    assert.ok(actions.includes(AUDIT_ACTIONS.SUBJECT_OVERRIDE_CHANGED), "Must log subject override change");
  });
});
