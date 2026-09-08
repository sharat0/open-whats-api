export interface CsvRow {
  phone: string;
  variables: Record<string, string>;
}

export interface CsvParseResult {
  rows: CsvRow[];
  headers: string[];
  error?: string;
}

/**
 * Parse a CSV string containing leads and custom placeholders/variables.
 * The first row is treated as the headers row.
 * The utility automatically identifies the phone number column by searching for common
 * headers like 'phone', 'number', 'to', 'chatid', 'recipient', 'contact'.
 * If none matches, it defaults to the first column.
 */
export function parseCsvLeads(text: string): CsvParseResult {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // handle CRLF
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(cell => cell !== '')) {
        lines.push(row);
      }
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  // Handle trailing fields without a newline
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some(cell => cell !== '')) {
      lines.push(row);
    }
  }

  if (lines.length < 2) {
    return { rows: [], headers: [], error: 'CSV must contain at least a header row and one data row' };
  }

  const rawHeaders = lines[0];
  const headers = rawHeaders.map(h => h.toLowerCase().trim());

  // Find phone number column index
  let phoneIdx = headers.findIndex(h =>
    ['phone', 'number', 'to', 'chatid', 'recipient', 'contact'].includes(h)
  );
  if (phoneIdx === -1) {
    phoneIdx = 0; // fallback to the first column
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;

    let rawPhone = line[phoneIdx] || '';
    if (!rawPhone) continue;

    // Normalize phone number to @c.us if not already fully formatted
    if (!rawPhone.includes('@')) {
      const digits = rawPhone.replace(/[^0-9]/g, '');
      if (!digits) continue;
      rawPhone = `${digits}@c.us`;
    }

    const variables: Record<string, string> = {};
    rawHeaders.forEach((header, idx) => {
      const key = header.trim();
      if (key) {
        variables[key] = line[idx] || '';
      }
    });

    rows.push({
      phone: rawPhone,
      variables,
    });
  }

  if (rows.length === 0) {
    return { rows: [], headers: rawHeaders, error: 'No valid phone numbers found in the CSV data rows' };
  }

  return { rows, headers: rawHeaders };
}

/**
 * Extract unique variable placeholders like {{name}} or {{ var_key }} from template text.
 */
export function extractPlaceholders(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g), match => match[1]))).sort();
}

/**
 * Apply custom CSV column mappings to a row's raw variables.
 * For each placeholder key mapped to a csvColumn, if that column exists in row.variables,
 * place it in the resulting variables map under placeholder key.
 */
export function mapRowVariables(
  rowVariables: Record<string, string>,
  variableMappings: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...rowVariables };
  for (const [placeholder, csvCol] of Object.entries(variableMappings)) {
    if (csvCol && rowVariables[csvCol] !== undefined) {
      result[placeholder] = rowVariables[csvCol];
    }
  }
  return result;
}

