require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const CollegeSettings = require('../models/CollegeSettings');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Examination = require('../models/Examination');
const Submission = require('../models/Submission');
const ExamResult = require('../models/ExamResult');
const { ROLES, EXAM_STATUS, STUDENT_STATUS } = require('../config/constants');
const { generateSecureToken } = require('../utils/tokens');
const { calcAttendancePercentage, buildExamResult } = require('../services/calculationService');

const CLASS_DEFS = [
  {
    name: 'Pre Medical 1st Year',
    subjects: [
      { name: 'Biology', totalMarks: 100, passingMarks: 40 },
      { name: 'Chemistry', totalMarks: 100, passingMarks: 40 },
      { name: 'Physics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
      { name: 'Urdu', totalMarks: 100, passingMarks: 33 },
      { name: 'Islamiat', totalMarks: 50, passingMarks: 17 },
    ],
  },
  {
    name: 'Pre Medical 2nd Year',
    subjects: [
      { name: 'Biology', totalMarks: 100, passingMarks: 40 },
      { name: 'Chemistry', totalMarks: 100, passingMarks: 40 },
      { name: 'Physics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
      { name: 'Pakistan Studies', totalMarks: 50, passingMarks: 17 },
    ],
  },
  {
    name: 'Pre Engineering 1st Year',
    subjects: [
      { name: 'Mathematics', totalMarks: 100, passingMarks: 40 },
      { name: 'Chemistry', totalMarks: 100, passingMarks: 40 },
      { name: 'Physics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
      { name: 'Urdu', totalMarks: 100, passingMarks: 33 },
    ],
  },
  {
    name: 'Pre Engineering 2nd Year',
    subjects: [
      { name: 'Mathematics', totalMarks: 100, passingMarks: 40 },
      { name: 'Chemistry', totalMarks: 100, passingMarks: 40 },
      { name: 'Physics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
    ],
  },
  {
    name: 'Computer Science 1st Year',
    subjects: [
      { name: 'Computer Science', totalMarks: 100, passingMarks: 40 },
      { name: 'Mathematics', totalMarks: 100, passingMarks: 40 },
      { name: 'Physics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
    ],
  },
  {
    name: 'Computer Science 2nd Year',
    subjects: [
      { name: 'Computer Science', totalMarks: 100, passingMarks: 40 },
      { name: 'Mathematics', totalMarks: 100, passingMarks: 40 },
      { name: 'Statistics', totalMarks: 100, passingMarks: 40 },
      { name: 'English', totalMarks: 100, passingMarks: 33 },
    ],
  },
  {
    name: 'Arts 1st Year',
    subjects: [
      { name: 'English', totalMarks: 100, passingMarks: 33 },
      { name: 'Urdu', totalMarks: 100, passingMarks: 33 },
      { name: 'Civics', totalMarks: 100, passingMarks: 33 },
      { name: 'Economics', totalMarks: 100, passingMarks: 33 },
    ],
  },
  {
    name: 'Arts 2nd Year',
    subjects: [
      { name: 'English', totalMarks: 100, passingMarks: 33 },
      { name: 'Urdu', totalMarks: 100, passingMarks: 33 },
      { name: 'Civics', totalMarks: 100, passingMarks: 33 },
      { name: 'History', totalMarks: 100, passingMarks: 33 },
    ],
  },
];

const FIRST_NAMES = [
  'Ali', 'Ahmed', 'Usman', 'Hamza', 'Bilal', 'Saad', 'Hassan', 'Hussain', 'Zain', 'Faizan',
  'Ayesha', 'Fatima', 'Sana', 'Mahnoor', 'Zainab', 'Hira', 'Iqra', 'Amna', 'Rabia', 'Sadia',
];
const LAST_NAMES = ['Khan', 'Ahmed', 'Malik', 'Hussain', 'Shah', 'Rehman', 'Iqbal', 'Bangash', 'Yousaf', 'Raza'];

const SESSION = '2026-27';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName(rollNo) {
  const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
}

async function seed() {
  await connectDB();
  console.log('[Seed] Connected. Clearing existing demo-relevant collections...');

  await Promise.all([
    User.deleteMany({}),
    CollegeSettings.deleteMany({}),
    Class.deleteMany({}),
    Student.deleteMany({}),
    Examination.deleteMany({}),
    Submission.deleteMany({}),
    ExamResult.deleteMany({}),
  ]);

  // --- Users ---
  const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@college.com';
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'SuperAdmin@123';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@college.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  const superAdmin = await User.create({
    name: 'System Super Admin',
    email: superAdminEmail,
    passwordHash: await User.hashPassword(superAdminPassword),
    role: ROLES.SUPER_ADMIN,
  });

  const admin = await User.create({
    name: 'College Admin',
    email: adminEmail,
    passwordHash: await User.hashPassword(adminPassword),
    role: ROLES.ADMIN,
    createdBy: superAdmin._id,
  });

  console.log(`[Seed] Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`[Seed] Admin: ${adminEmail} / ${adminPassword}`);

  // --- College settings ---
  await CollegeSettings.create({
    collegeName: 'Government Degree College',
    address: 'College Road',
    city: 'Kohat',
    province: 'Khyber Pakhtunkhwa',
    country: 'Pakistan',
    phone: '+92-300-0000000',
    email: adminEmail,
    website: 'https://example.edu.pk',
    principalName: 'Prof. Dr. Muhammad Iqbal',
    academicSession: SESSION,
  });

  // --- Classes ---
  const classes = [];
  for (const def of CLASS_DEFS) {
    const klass = await Class.create({
      name: def.name,
      academicSession: SESSION,
      description: `${def.name} - Academic Session ${SESSION}`,
      subjects: def.subjects,
      createdBy: admin._id,
    });
    classes.push(klass);
  }
  console.log(`[Seed] Created ${classes.length} classes`);

  // --- Students ---
  const studentsByClass = new Map();
  for (const klass of classes) {
    const count = randomInt(15, 20);
    const students = [];
    for (let i = 1; i <= count; i++) {
      const rollNumber = String(1000 + i);
      const student = await Student.create({
        name: randomName(i),
        fatherName: randomName(i),
        rollNumber,
        registrationNumber: `REG-${klass.name.substring(0, 3).toUpperCase()}-${rollNumber}`,
        admissionNumber: `ADM-${rollNumber}`,
        class: klass._id,
        academicSession: SESSION,
        gender: i % 2 === 0 ? 'female' : 'male',
        createdBy: admin._id,
      });
      students.push(student);
    }
    studentsByClass.set(klass._id.toString(), students);
  }
  console.log('[Seed] Created students for every class');

  // Strike off one student in the first class, as required for test coverage
  const firstClassStudents = studentsByClass.get(classes[0]._id.toString());
  const struckOffStudent = firstClassStudents[firstClassStudents.length - 1];
  struckOffStudent.status = STUDENT_STATUS.STRUCK_OFF;
  struckOffStudent.struckOffAt = new Date();
  struckOffStudent.struckOffReason = 'Discontinued studies (demo data)';
  struckOffStudent.strikeOffRecords.push({
    subject: null,
    subjectName: null,
    reason: 'Discontinued studies (demo data)',
    isActive: true,
    struckOffAt: new Date(),
    struckOffBy: admin._id,
    struckOffByName: admin.name,
  });
  await struckOffStudent.save();
  console.log(`[Seed] Struck off demo student: ${struckOffStudent.name} (Roll ${struckOffStudent.rollNumber})`);

  // --- Examinations + submissions + finalized results ---
  // Create 3 "Monthly Test" exams for the first two classes so overall
  // reports / dashboards / trends have real data to show.
  const examTargets = classes.slice(0, 2); // Pre Medical 1st & 2nd Year
  const examNames = ['Monthly Test 1', 'Monthly Test 2', 'Monthly Test 3'];

  for (const klass of examTargets) {
    const students = studentsByClass.get(klass._id.toString());
    let previousExam = null;

    for (let idx = 0; idx < examNames.length; idx++) {
      const resultDate = new Date();
      resultDate.setMonth(resultDate.getMonth() - (examNames.length - 1 - idx));

      const exam = await Examination.create({
        name: examNames[idx],
        examType: 'Monthly Test',
        class: klass._id,
        academicSession: SESSION,
        resultDate,
        subjects: klass.subjects.map((s) => ({
          subject: s._id,
          name: s.name,
          code: s.code,
          totalMarks: s.totalMarks,
          passingMarks: s.passingMarks,
        })),
        status: EXAM_STATUS.SUBMISSION_OPEN,
        submissionToken: generateSecureToken(),
        isLinkActive: idx === examNames.length - 1, // only the latest exam keeps an active demo link
        createdFrom: previousExam ? previousExam._id : null,
        createdBy: admin._id,
      });

      // Simulate teacher submissions for every subject
      for (const subj of exam.subjects) {
        const totalLectures = randomInt(30, 45);
        const entries = students.map((student) => {
          if (student.status === STUDENT_STATUS.STRUCK_OFF) {
            return {
              student: student._id,
              rollNumber: student.rollNumber,
              studentName: student.name,
              statusAtSubmission: STUDENT_STATUS.STRUCK_OFF,
              struckOffReason: student.struckOffReason || '',
              struckOffSubjectName: null,
              classesAttended: null,
              attendancePercentage: null,
              obtainedMarks: null,
            };
          }
          const classesAttended = randomInt(Math.floor(totalLectures * 0.6), totalLectures);
          const obtainedMarks = randomInt(Math.floor(subj.totalMarks * 0.3), subj.totalMarks);
          return {
            student: student._id,
            rollNumber: student.rollNumber,
            studentName: student.name,
            statusAtSubmission: STUDENT_STATUS.ACTIVE,
            classesAttended,
            attendancePercentage: calcAttendancePercentage(classesAttended, totalLectures),
            obtainedMarks,
          };
        });

        await Submission.create({
          examination: exam._id,
          subject: subj.subject,
          subjectName: subj.name,
          teacherName: `${subj.name} Teacher`,
          totalLecturesDelivered: totalLectures,
          entries,
        });
      }

      // Finalize this exam (compute + store snapshot), except leave the very
      // last exam of the very last class as "ready for review" so the Admin
      // has something to finalize manually when testing.
      const isLastExamOfLastClass =
        idx === examNames.length - 1 && klass._id.toString() === examTargets[examTargets.length - 1]._id.toString();

      if (!isLastExamOfLastClass) {
        const submissions = await Submission.find({ examination: exam._id });
        const submissionsBySubject = new Map(submissions.map((s) => [s.subject.toString(), s]));
        const { studentResults, stats } = buildExamResult(students, exam.subjects, submissionsBySubject);

        await ExamResult.create({
          examination: exam._id,
          students: studentResults,
          stats,
          finalizedBy: admin._id,
          finalizedAt: new Date(),
        });

        exam.status = EXAM_STATUS.FINALIZED;
        exam.finalizedAt = new Date();
        exam.finalizedBy = admin._id;
        exam.isLinkActive = false;
      } else {
        exam.status = EXAM_STATUS.READY_FOR_REVIEW;
      }
      await exam.save();

      previousExam = exam;
      console.log(`[Seed] ${klass.name} — ${exam.name}: ${exam.status}`);
    }
  }

  console.log('[Seed] Done.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
