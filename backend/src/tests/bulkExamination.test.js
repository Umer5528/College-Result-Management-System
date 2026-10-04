require("dotenv").config();
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Class = require("../models/Class");
const Examination = require("../models/Examination");
const Submission = require("../models/Submission");
const ExamResult = require("../models/ExamResult");
const AuditLog = require("../models/AuditLog");
const { generateAuthToken } = require("../utils/tokens");
const { EXAM_STATUS, AUDIT_ACTIONS } = require("../config/constants");

describe("Bulk Examination Creation Integration Tests", () => {
  let server;
  let baseUrl;
  let admin;
  let adminToken;
  let superAdminToken;
  const testClassIds = [];
  const testExamIds = [];

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
    process.env.JWT_SECRET ||= "test-jwt-secret-bulk-exam";
    await mongoose.connect(process.env.MONGODB_URI);

    admin = await User.create({
      name: "Bulk Exam Admin",
      email: `bulk_admin_${Date.now()}@college.edu`,
      passwordHash: "not-used",
      role: "admin",
    });
    adminToken = generateAuthToken(admin);

    const superAdmin = await User.create({
      name: "Bulk Exam Super Admin",
      email: `bulk_super_${Date.now()}@college.edu`,
      passwordHash: "not-used",
      role: "super_admin",
    });
    superAdminToken = generateAuthToken(superAdmin);

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;

    // Create 3 test classes with different subjects:
    // Class 1: English (20/8), Physics (20/8), Chemistry (20/8)
    // Class 2: English (20/8), Physics (20/8), Computer (20/8)
    // Class 3: English (20/8), Biology (20/8)
    const c1 = await Class.create({
      name: "TEST_Bulk Class 1",
      academicSession: "2026-27",
      subjects: [
        { name: "English", totalMarks: 20, passingMarks: 8 },
        { name: "Physics", totalMarks: 20, passingMarks: 8 },
        { name: "Chemistry", totalMarks: 20, passingMarks: 8 },
      ],
      createdBy: admin._id,
    });
    const c2 = await Class.create({
      name: "TEST_Bulk Class 2",
      academicSession: "2026-27",
      subjects: [
        { name: "English", totalMarks: 20, passingMarks: 8 },
        { name: "Physics", totalMarks: 20, passingMarks: 8 },
        { name: "Computer", totalMarks: 20, passingMarks: 8 },
      ],
      createdBy: admin._id,
    });
    const c3 = await Class.create({
      name: "TEST_Bulk Class 3",
      academicSession: "2026-27",
      subjects: [
        { name: "English", totalMarks: 20, passingMarks: 8 },
        { name: "Biology", totalMarks: 20, passingMarks: 8 },
      ],
      createdBy: admin._id,
    });

    testClassIds.push(c1._id, c2._id, c3._id);
  });

  after(async () => {
    if (server) server.close();
    await Promise.all([
      ExamResult.deleteMany({ examination: { $in: testExamIds } }),
      Submission.deleteMany({ examination: { $in: testExamIds } }),
      Examination.deleteMany({ _id: { $in: testExamIds } }),
      Class.deleteMany({ _id: { $in: testClassIds } }),
      AuditLog.deleteMany({ user: admin._id }),
      User.deleteOne({ _id: admin._id }),
    ]);
    await mongoose.disconnect();
  });

  test("1. Create examination for one class normally", async () => {
    const res = await request("/examinations", {
      method: "POST",
      body: {
        name: "TEST_Single Exam",
        examType: "Monthly Test",
        class: testClassIds[0],
        academicSession: "2026-27",
        resultDate: new Date().toISOString(),
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, "TEST_Single Exam");
    testExamIds.push(res.body.data._id);
  });

  test("2. Bulk Preview detects per-class subjects and duplicates", async () => {
    // First preview when Class 1 already has TEST_Single Exam
    const previewRes = await request("/examinations/bulk-preview", {
      method: "POST",
      body: {
        name: "TEST_Single Exam",
        examType: "Monthly Test",
        classIds: testClassIds,
        academicSession: "2026-27",
        resultDate: new Date().toISOString(),
      },
    });

    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.body.data.alreadyExists.length, 1, "Class 1 should be detected as already exists");
    assert.equal(previewRes.body.data.alreadyExists[0].className, "TEST_Bulk Class 1");
    assert.equal(previewRes.body.data.willCreate.length, 2, "Classes 2 and 3 should be in willCreate");

    // Check that subjects are resolved PER CLASS
    const class2Preview = previewRes.body.data.willCreate.find((c) => c.className === "TEST_Bulk Class 2");
    const class3Preview = previewRes.body.data.willCreate.find((c) => c.className === "TEST_Bulk Class 3");
    assert.equal(class2Preview.subjects.length, 3);
    assert.ok(class2Preview.subjects.some((s) => s.name === "Computer"));
    assert.equal(class3Preview.subjects.length, 2);
    assert.ok(class3Preview.subjects.some((s) => s.name === "Biology"));
  });

  test("3. Bulk Create rejects duplicates without skipExisting (409 Conflict)", async () => {
    const conflictRes = await request("/examinations/bulk", {
      method: "POST",
      body: {
        name: "TEST_Single Exam",
        examType: "Monthly Test",
        classIds: testClassIds,
        resultDate: new Date().toISOString(),
        skipExisting: false,
      },
    });

    assert.equal(conflictRes.status, 409, "Should return 409 conflict when duplicates exist and skipExisting=false");
    assert.equal(conflictRes.body.errors.alreadyExists.length, 1);
  });

  test("4. Bulk Create creates remaining when skipExisting is true", async () => {
    const bulkRes = await request("/examinations/bulk", {
      method: "POST",
      body: {
        name: "TEST_Single Exam",
        examType: "Monthly Test",
        classIds: testClassIds,
        resultDate: new Date().toISOString(),
        skipExisting: true,
        generateLinks: true,
      },
    });

    assert.equal(bulkRes.status, 201);
    assert.equal(bulkRes.body.data.summary.createdCount, 2);
    assert.equal(bulkRes.body.data.summary.skippedCount, 1);

    for (const exam of bulkRes.body.data.createdExaminations) {
      testExamIds.push(exam._id);
      assert.ok(exam._id);
      assert.ok(exam.submissionToken, "Must have independent submission token");
    }
  });

  test("5. Bulk Create across multiple classes creates independent exams with separate IDs and tokens", async () => {
    const bulkRes = await request("/examinations/bulk", {
      method: "POST",
      body: {
        name: "TEST_Mid Term 2026",
        examType: "Mid Term",
        classIds: testClassIds,
        resultDate: new Date().toISOString(),
        generateLinks: true,
      },
    });

    assert.equal(bulkRes.status, 201);
    assert.equal(bulkRes.body.data.createdExaminations.length, 3);

    const tokenSet = new Set();
    const idSet = new Set();

    for (const exam of bulkRes.body.data.createdExaminations) {
      testExamIds.push(exam._id);
      idSet.add(exam._id.toString());
      tokenSet.add(exam.submissionToken);

      const dbExam = await Examination.findById(exam._id);
      assert.equal(dbExam.status, EXAM_STATUS.SUBMISSION_OPEN);
      assert.equal(dbExam.isLinkActive, true);

      // Verify each class received its own correct subjects
      if (exam.className === "TEST_Bulk Class 3") {
        assert.equal(dbExam.subjects.length, 2);
        assert.ok(dbExam.subjects.some((s) => s.name === "Biology"));
      } else if (exam.className === "TEST_Bulk Class 2") {
        assert.equal(dbExam.subjects.length, 3);
        assert.ok(dbExam.subjects.some((s) => s.name === "Computer"));
      } else if (exam.className === "TEST_Bulk Class 1") {
        assert.equal(dbExam.subjects.length, 3);
        assert.ok(dbExam.subjects.some((s) => s.name === "Chemistry"));
      }
    }

    assert.equal(idSet.size, 3, "All 3 examinations must have unique, independent IDs");
    assert.equal(tokenSet.size, 3, "All 3 examinations must have unique, independent submission tokens");
  });

  test("6. Create From Previous works with bulk-created exams", async () => {
    const sourceExamId = testExamIds[testExamIds.length - 1]; // TEST_Bulk Class 3 exam
    const copyRes = await request(`/examinations/${sourceExamId}/create-from-previous`, {
      method: "POST",
      body: {
        name: "TEST_Copied Next Month",
        resultDate: new Date().toISOString(),
      },
    });

    assert.equal(copyRes.status, 201);
    assert.equal(copyRes.body.data.subjects.length, 2);
    assert.equal(copyRes.body.data.createdFrom, sourceExamId);
    testExamIds.push(copyRes.body.data._id);
  });

  test("7. Finalize one bulk-created exam, verify independence, and deleting result does NOT reopen exam", async () => {
    const examId = testExamIds[1]; // One of the bulk-created exams
    const otherExamId = testExamIds[2]; // Another bulk-created exam

    const exam = await Examination.findById(examId);

    // Simulate teacher submissions for all subjects of this exam
    for (const s of exam.subjects) {
      await Submission.create({
        examination: exam._id,
        subject: s.subject,
        subjectName: s.name,
        teacherName: "Teacher",
        totalLecturesDelivered: 10,
        entries: [],
      });
    }

    // Finalize exam
    const finalizeRes = await request(`/results/${exam._id}/finalize`, { method: "POST" });
    assert.equal(finalizeRes.status, 200);

    const refreshedExam = await Examination.findById(exam._id);
    assert.equal(refreshedExam.status, EXAM_STATUS.FINALIZED);
    assert.ok(refreshedExam.finalizedAt);
    assert.ok(refreshedExam.finalizedBy);

    // Verify other exam status was NOT changed
    const refreshedOther = await Examination.findById(otherExamId);
    assert.notEqual(refreshedOther.status, EXAM_STATUS.FINALIZED, "Other bulk-created exam must remain independent");

    // Verify deleting result snapshot does NOT reopen the exam
    const deleteResultRes = await request(`/results/${exam._id}`, { method: "DELETE" });
    assert.equal(deleteResultRes.status, 200);

    const examAfterResultDelete = await Examination.findById(exam._id);
    assert.equal(examAfterResultDelete.status, EXAM_STATUS.FINALIZED, "Deleting result snapshot must NOT reset exam status");
    assert.ok(examAfterResultDelete.finalizedAt, "finalizedAt must not be cleared");
    assert.ok(examAfterResultDelete.finalizedBy, "finalizedBy must not be cleared");

    // Only explicit reopen (Super Admin) can reopen it
    const reopenRes = await request(`/results/${exam._id}/reopen`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(reopenRes.status, 200);
    const reopenedExam = await Examination.findById(exam._id);
    assert.equal(reopenedExam.status, EXAM_STATUS.READY_FOR_REVIEW);
  });

  test("8. Verify bulk audit logs were created", async () => {
    const logs = await AuditLog.find({ user: admin._id });
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes(AUDIT_ACTIONS.BULK_EXAM_CREATED), "Must log bulk exam creation");
  });
});
