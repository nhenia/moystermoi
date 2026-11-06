import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  return NextResponse.json({
    suggestions: [
      { id: '1', label: `${query} Fake Location 1` },
      { id: '2', label: `${query} Fake Location 2`, secondaryLabel: 'Secondary info' }
    ]
  });
}
