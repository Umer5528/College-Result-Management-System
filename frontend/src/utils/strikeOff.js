/** Mirrors Student.getActiveStrikeOff() on the backend. */
export function getActiveStrikeOff(student) {
  if (!student?.strikeOffRecords) return null;
  return student.strikeOffRecords.find((r) => r.isActive) || null;
}
