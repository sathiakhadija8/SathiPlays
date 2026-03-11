import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureCultureSchema } from '../../../../lib/culture-server';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type CultureRow = RowDataPacket & {
  id: number;
  title: string;
  type: 'movie' | 'series' | 'book';
  in_wishlist: number;
  image_url: string;
  language: string;
  genres: string | null;
  category_kind: 'fiction' | 'deen' | null;
  rating: number | null;
  review_text: string | null;
  date_started: string | null;
  date_completed: string | null;
  status: string | null;
  seasons_watched: number | null;
  episodes_watched: number | null;
  author: string | null;
  total_pages: number | null;
  pages_read: number | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
};

type CultureBody = {
  title?: unknown;
  type?: unknown;
  in_wishlist?: unknown;
  image_url?: unknown;
  language?: unknown;
  genres?: unknown;
  category_kind?: unknown;
  rating?: unknown;
  review_text?: unknown;
  date_started?: unknown;
  date_completed?: unknown;
  status?: unknown;
  seasons_watched?: unknown;
  episodes_watched?: unknown;
  author?: unknown;
  total_pages?: unknown;
  pages_read?: unknown;
  mood?: unknown;
};

const VALID_TYPES = new Set(['movie', 'series', 'book']);
const VALID_CATEGORY_KIND = new Set(['fiction', 'deen']);

function parseString(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function parseGenres(value: unknown) {
  if (!Array.isArray(value)) return [];
  const sanitized = value
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, 60) : ''))
    .filter(Boolean);
  return Array.from(new Set(sanitized));
}

function toResponseRow(row: CultureRow) {
  let genres: string[] = [];
  if (row.genres) {
    try {
      const parsed = JSON.parse(row.genres);
      if (Array.isArray(parsed)) {
        genres = parsed.filter((value) => typeof value === 'string');
      }
    } catch {
      genres = [];
    }
  }

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    in_wishlist: row.in_wishlist === 1,
    image_url: row.image_url,
    language: row.language,
    genres,
    category_kind: row.category_kind,
    rating: row.rating === null ? null : Number(row.rating),
    review_text: row.review_text,
    date_started: row.date_started,
    date_completed: row.date_completed,
    status: row.status,
    seasons_watched: row.seasons_watched,
    episodes_watched: row.episodes_watched,
    author: row.author,
    total_pages: row.total_pages,
    pages_read: row.pages_read,
    mood: row.mood,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    await ensureCultureSchema();
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') ?? '').trim().toLowerCase();

    const where: string[] = [];
    const params: Array<string> = [];
    if (type && VALID_TYPES.has(type)) {
      where.push('type = ?');
      params.push(type);
    }

    const [rows] = await pool.execute<CultureRow[]>(
      `
      SELECT
        id, title, type, in_wishlist, image_url, language, genres, category_kind, rating, review_text,
        date_started, date_completed, status, seasons_watched, episodes_watched, author, total_pages,
        pages_read, mood, created_at, updated_at
      FROM culture_entries
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(date_completed, created_at) DESC, created_at DESC
      `,
      params,
    );

    return NextResponse.json(rows.map(toResponseRow));
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load culture entries.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCultureSchema();
    const body = (await request.json()) as CultureBody;
    const title = parseString(body.title, 200);
    const typeRaw = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
    const type = VALID_TYPES.has(typeRaw) ? typeRaw : null;
    const imageUrl = parseString(body.image_url, 400);
    const language = parseString(body.language, 80);
    const genres = parseGenres(body.genres);
    const categoryKindRaw = typeof body.category_kind === 'string' ? body.category_kind.trim().toLowerCase() : '';
    const categoryKind = VALID_CATEGORY_KIND.has(categoryKindRaw) ? categoryKindRaw : null;

    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    if (!type) return NextResponse.json({ ok: false, message: 'type is invalid.' }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ ok: false, message: 'image_url is required.' }, { status: 400 });
    if (!language) return NextResponse.json({ ok: false, message: 'language is required.' }, { status: 400 });

    const inWishlist = body.in_wishlist ? 1 : 0;
    const rating = parseNumber(body.rating);
    const reviewText = parseString(body.review_text, 1200);
    const dateStarted = parseDate(body.date_started);
    const dateCompleted = parseDate(body.date_completed);
    const status = parseString(body.status, 40);
    const seasonsWatched = parseNumber(body.seasons_watched);
    const episodesWatched = parseNumber(body.episodes_watched);
    const author = parseString(body.author, 160);
    const totalPages = parseNumber(body.total_pages);
    const pagesRead = parseNumber(body.pages_read);
    const mood = parseString(body.mood, 80);

    const effectiveGenres = type === 'book' && categoryKind === 'deen' ? [] : genres;

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO culture_entries (
        title, type, in_wishlist, image_url, language, genres, category_kind, rating, review_text,
        date_started, date_completed, status, seasons_watched, episodes_watched, author, total_pages,
        pages_read, mood
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        title,
        type,
        inWishlist,
        imageUrl,
        language,
        JSON.stringify(effectiveGenres),
        categoryKind,
        rating,
        reviewText,
        dateStarted,
        dateCompleted,
        status,
        seasonsWatched,
        episodesWatched,
        author,
        totalPages,
        pagesRead,
        mood,
      ],
    );

    const pointsAwarded = type === 'book' ? 14 : 12;
    await addPointsSafe({
      domain: 'culture',
      sourceType: `culture_${type}_entry`,
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `${type} entry created`,
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create culture entry.' }, { status: 500 });
  }
}
