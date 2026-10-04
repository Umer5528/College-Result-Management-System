const express = require("express");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { protect, requireAnyAdmin } = require("../middleware/auth");
const {
  listGlobalSubjects,
  getGlobalSubject,
  createGlobalSubject,
  updateGlobalSubject,
  deleteGlobalSubject,
  migrateSubjects,
  updateGlobalSubjectDefaults,
  applySubjectConfigurations,
} = require("../controllers/globalSubjectController");

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get("/", listGlobalSubjects);
router.get("/:id", getGlobalSubject);

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Subject name is required"),
    body("totalMarks").isFloat({ gt: 0 }).withMessage("Total marks must be a positive number"),
    body("passingMarks").isFloat({ min: 0 }).withMessage("Passing marks must be nonnegative"),
  ],
  validate,
  createGlobalSubject,
);

router.put(
  "/:id",
  [
    body("name").optional().isString().trim().notEmpty().withMessage("Subject name cannot be empty"),
    body("totalMarks").optional().isFloat({ gt: 0 }).withMessage("Total marks must be a positive number"),
    body("passingMarks").optional().isFloat({ min: 0 }).withMessage("Passing marks must be nonnegative"),
  ],
  validate,
  updateGlobalSubject,
);

router.delete("/:id", deleteGlobalSubject);
router.post("/migrate", migrateSubjects);

// Backward compatibility routes
router.put("/:id/defaults", updateGlobalSubjectDefaults);
router.post("/apply", applySubjectConfigurations);

module.exports = router;
