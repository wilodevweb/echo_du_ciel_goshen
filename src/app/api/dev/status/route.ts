export async function GET(request: Request) {
  if (request.headers.get('x-goshen-demo-probe') !== '1' || process.env.GOSHEN_DEMO_MODE !== '1') {
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return Response.json(
    { mode: 'demo' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
