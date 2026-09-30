import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFParse } from 'pdf-parse'

function makeTextPdf(text) {
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source, 'ascii'))
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(source, 'ascii')
  source += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(source, 'ascii')
}

test('extracts text from an uploaded PDF and releases parser resources', async () => {
  const parser = new PDFParse({ data: makeTextPdf('JH One PDF Test'), verbosity: 0, isEvalSupported: false })
  try {
    const result = await parser.getText({ first: 80 })
    assert.match(result.text, /JH One PDF Test/)
  } finally {
    await parser.destroy()
  }
})
