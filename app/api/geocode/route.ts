import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  return NextResponse.json({
    location: {
      latitude: 29.9511,
      longitude: -90.0715,
      label: `Resolved Location for ID ${id}`,
    }
  });
}
