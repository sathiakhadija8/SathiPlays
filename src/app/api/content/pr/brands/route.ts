import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type PrBrandRow = RowDataPacket & {
  id: number;
  brand_id: number;
  company_name: string;
  contact_email: string | null;
  contact_person: string | null;
  status: 'pitched' | 'in_discussion' | 'gifted' | 'paid' | 'declined';
  notes: string | null;
  created_at: string;
};

type Body = {
  id?: unknown;
  brand_id?: unknown;
  company_name?: unknown;
  contact_email?: unknown;
  contact_person?: unknown;
  status?: unknown;
  notes?: unknown;
};

const VALID_STATUS = new Set(['pitched', 'in_discussion', 'gifted', 'paid', 'declined']);

function parseString(value: unknown, max = 255) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<PrBrandRow[]>(
      `
      SELECT id, brand_id, company_name, contact_email, contact_person, status, notes, created_at
      FROM pr_brands
      WHERE brand_id = ?
      ORDER BY created_at DESC
      `,
      [brandId],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load PR brands.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const companyName = parseString(body.company_name, 160);
    const contactEmail = parseString(body.contact_email, 160);
    const contactPerson = parseString(body.contact_person, 160);
    const statusRaw = typeof body.status === 'string' ? body.status.trim().toLowerCase() : 'pitched';
    const status = VALID_STATUS.has(statusRaw) ? statusRaw : null;
    const notes = parseString(body.notes, 4000);

    if (!Number.isInteger(brandId) || brandId <= 0 || !companyName || !status) {
      return NextResponse.json({ ok: false, message: 'brand_id, company_name and valid status are required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO pr_brands (brand_id, company_name, contact_email, contact_person, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [brandId, companyName, contactEmail, contactPerson, status, notes],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create PR brand.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = Number(body.id);
    const brandId = Number(body.brand_id);
    const companyName = parseString(body.company_name, 160);
    const contactEmail = parseString(body.contact_email, 160);
    const contactPerson = parseString(body.contact_person, 160);
    const statusRaw = body.status === undefined ? undefined : typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const status = statusRaw === undefined ? undefined : VALID_STATUS.has(statusRaw) ? statusRaw : null;
    const notes = parseString(body.notes, 4000);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (status === null) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE pr_brands
      SET
        company_name = COALESCE(?, company_name),
        contact_email = COALESCE(?, contact_email),
        contact_person = COALESCE(?, contact_person),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
      WHERE id = ?
        AND brand_id = ?
      `,
      [companyName, contactEmail, contactPerson, status === undefined ? null : status, notes, id, brandId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'PR brand not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update PR brand.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM pr_brands WHERE id = ? AND brand_id = ?',
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'PR brand not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete PR brand.' }, { status: 500 });
  }
}
