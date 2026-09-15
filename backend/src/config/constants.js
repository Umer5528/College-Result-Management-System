const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
});

const STUDENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  STRUCK_OFF: 'struck_off',
});

const EXAM_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMISSION_OPEN: 'submission_open',
  SUBMISSION_IN_PROGRESS: 'submission_in_progress',
  READY_FOR_REVIEW: 'ready_for_review',
  FINALIZED: 'finalized',
  ARCHIVED: 'archived',
});

const SUBMISSION_STATUS = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
});

const AUDIT_ACTIONS = Object.freeze({
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  STUDENT_CREATED: 'student_created',
  STUDENT_EDITED: 'student_edited',
  STUDENT_STRUCK_OFF: 'student_struck_off',
  STUDENT_RESTORED: 'student_restored',
  STUDENT_DELETED: 'student_deleted',
  CLASS_CREATED: 'class_created',
  CLASS_EDITED: 'class_edited',
  CLASS_DELETED: 'class_deleted',
  SUBJECT_ADDED: 'subject_added',
  EXAM_CREATED: 'exam_created',
  EXAM_EDITED: 'exam_edited',
  SUBMISSION_LINK_GENERATED: 'submission_link_generated',
  SUBMISSION_LINK_DISABLED: 'submission_link_disabled',
  RESULT_SUBMITTED: 'result_submitted',
  SUBMISSION_EDITED: 'submission_edited',
  RESULT_FINALIZED: 'result_finalized',
  RESULT_REOPENED: 'result_reopened',
  RESULT_DELETED: 'result_deleted',
  REPORT_GENERATED: 'report_generated',
  ADMIN_CREATED: 'admin_created',
  ADMIN_EDITED: 'admin_edited',
  ADMIN_DISABLED: 'admin_disabled',
  ADMIN_ENABLED: 'admin_enabled',
  ADMIN_PASSWORD_RESET: 'admin_password_reset',
  SETTINGS_UPDATED: 'settings_updated',
  STUDENTS_BULK_IMPORTED: 'students_bulk_imported',
});

module.exports = { ROLES, STUDENT_STATUS, EXAM_STATUS, SUBMISSION_STATUS, AUDIT_ACTIONS };
