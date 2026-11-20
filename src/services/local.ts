export async function localRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined && method === 'POST' ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', 'X-Mengnan-Client': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(error?.error?.message || '无法连接本地服务，请检查服务终端。')
  }
  return response.json() as Promise<T>
}
