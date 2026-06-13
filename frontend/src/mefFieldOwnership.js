// Field ownership for the Medical Examination Form (MEF) PDF.
// Used to show "Filled up by Student" / "Filled up by Nurse" tooltips
// when hovering over AcroForm fields in the preview.

export const STUDENT_OWNED_FIELDS = new Set([
  // Text fields (14)
  "ID Number", "Date", "Last Name", "First Name", "MI", "Birthday",
  "Contact Number", "College Section", "Academic Year", "Emergency Name",
  "Relationship", "Emergency Contact", "Student Name Auth", "Student Age",
  // Checkboxes (2)
  "Gender Female", "Gender Male",
]);

// Returns "Student" or "Nurse" for a given PDF AcroForm field name.
export function getFieldOwner(fieldName) {
  return STUDENT_OWNED_FIELDS.has(fieldName) ? "Student" : "Nurse";
}
