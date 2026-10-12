export const analysisViews = [
  'overview',
  'trends',
  'pages',
  'sources',
  'audience',
  'behavior',
] as const

export type AnalysisView = (typeof analysisViews)[number]
