export function toCsv(rows, timezone = 'UTC') {
  const columns = [
    'project_name',
    'user_id',
    'user_name',
    'user_email',
    'ip', 'action', 'target', 'label', 'visitor', 'session',
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
          .map((key) => cell(key === 'occurred_at' ? (timezone === 'Asia/Shanghai' ? new Date(row[key] + 8 * 3600000).toISOString().replace('Z', '+08:00') : new Date(row[key]).toISOString()) : row[key]))
          .join(',')
      ),
    ].join('\r\n')
  )
}
