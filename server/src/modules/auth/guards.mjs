import { AppError } from '../../shared/errors.mjs'

export async function requireSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const origin = request.headers.origin
  if (
    request.headers['sec-fetch-site'] === 'cross-site' ||
    (origin && origin !== `${request.protocol}://${request.host}`)
  ) {
    throw new AppError('FORBIDDEN', '不允许跨站管理请求')
  }
}

export function createAdminGuard(auth) {
  return async (request) => {
    await auth.authenticate(request.cookies.visora_session)
    await requireSameOrigin(request)
  }
}
