/**
 * Shared parsing logic for bulk student import — both the "paste text" flow
 * and the Excel upload flow recognize the same header aliases, so a college
 * office doesn't need to match an exact spelling.
 */

const FIELD_ALIASES = {
  rollNumber: ['rollno', 'rollnumber', 'roll', 'r'],
  name: ['studentname', 'name'],
  fatherName: ['fathername', 'fname', 'fathersname', 'father'],
  fatherContact: [
    'fathercontact',
    'fatherscontact',
    'fcontactnumber',
    'fcontact',
    'contactnumber',
    'contact',
    'fatherscontactnumber',
    'fatherphonenumber',
    'fatherphone',
  ],
  registrationNumber: ['registrationnumber', 'regno', 'registrationno'],
  admissionNumber: ['admissionnumber', 'admno', 'admissionno'],
};

/** "F. Contact Number" -> "fcontactnumber" — strips everything but letters/digits. */
function normalizeHeaderToken(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Which canonical field (if any) a raw header cell refers to. */
function matchField(rawHeaderCell) {
  const normalized = normalizeHeaderToken(rawHeaderCell);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

/**
 * Parses pasted plain text into student rows. Supports:
 *  - comma-separated or tab-separated lines
 *  - an optional header row (any recognized spelling/casing/punctuation)
 *  - the legacy positional 3-column (roll, name, father's name) and
 *    4-column (+ father's contact) formats when no header is present
 *
 * Returns { rows: [{ lineNumber, rollNumber, name, fatherName, fatherContact }], usedHeader }
 */
function parseTextImport(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], usedHeader: false };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const splitLine = (line) => line.split(delimiter).map((c) => c.trim());

  const firstCells = splitLine(lines[0]);
  const headerMatches = firstCells.map(matchField);
  // Treat the first line as a header only if it clearly names at least roll
  // number and student name — anything less ambiguous stays as data so a
  // legitimate first student isn't accidentally swallowed as a header.
  const looksLikeHeader = headerMatches.includes('rollNumber') && headerMatches.includes('name');

  let columnOrder;
  let dataLines;
  if (looksLikeHeader) {
    columnOrder = headerMatches; // e.g. ['rollNumber','name','fatherName','fatherContact']
    dataLines = lines.slice(1);
  } else {
    // Legacy positional format: roll, name, father's name[, father's contact]
    columnOrder = ['rollNumber', 'name', 'fatherName', 'fatherContact'];
    dataLines = lines;
  }

  const rows = dataLines.map((line, idx) => {
    const cells = splitLine(line);
    const row = { lineNumber: idx + 1 };
    columnOrder.forEach((field, i) => {
      if (field) row[field] = cells[i] !== undefined ? cells[i] : '';
    });
    return {
      lineNumber: row.lineNumber,
      rollNumber: row.rollNumber || '',
      name: row.name || '',
      fatherName: row.fatherName || '',
      fatherContact: row.fatherContact || '',
    };
  });

  return { rows, usedHeader: looksLikeHeader };
}

module.exports = { parseTextImport, matchField, normalizeHeaderToken };
