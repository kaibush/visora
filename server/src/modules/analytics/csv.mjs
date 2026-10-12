export function toCsv(rows) {
  const columns = [
    'project_name',
    'type',
    'name',
    'occurred_at',
    'path',
    'referrer',
    'browser',
    'os',
    'device',
    'language',
    'source',
    'event_id',
  ]
  const cell = (value) => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  return (
    '\uFEFF' +
    [
      columns.join(','),
      ...rows.map((row) =>
        columns
          .map((key) => cell(key === 'occurred_at' ? new Date(row[key]).toISOString() : row[key]))
          .join(',')
      ),
    ].join('\r\n')
  )
}
