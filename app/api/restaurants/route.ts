import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat')) || 29.9511;
  const lng = Number(searchParams.get('lng')) || -90.0715;

  return NextResponse.json({
    restaurants: [
      {
        id: 'rest1',
        name: 'Mock Oyster Bar',
        coordinates: { latitude: lat + 0.01, longitude: lng + 0.01 },
        address: '123 Fake St, City, ST',
        oysterOffering: {
          status: 'documented',
          description: 'Fresh oysters daily',
          evidence: { sourceUrl: 'https://example.com/menu', checkedAt: new Date().toISOString() }
        },
        operatingStatus: 'open',
      }
    ]
  });
}
