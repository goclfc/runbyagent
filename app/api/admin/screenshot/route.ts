import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, image_base64 } = body;

    if (!slug || !image_base64) {
      return NextResponse.json({ error: 'slug and image_base64 are required' }, { status: 400 });
    }

    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
    
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ error: 's3 not configured' }, { status: 500 });
    }

    const projectResult = await query(`
      SELECT id FROM projects WHERE slug = $1
    `, [slug]);
    
    if (projectResult.length === 0) {
      return NextResponse.json({ error: 'project not found' }, { status: 404 });
    }

    const buffer = Buffer.from(image_base64, 'base64');
    const key = `screenshots/${slug}-${Date.now()}.png`;

    const s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    }));

    const publicUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;

    await query(`
      UPDATE projects
      SET screenshot_url = $1
      WHERE slug = $2
    `, [publicUrl, slug]);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
