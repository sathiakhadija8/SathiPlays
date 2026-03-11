import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureCultureSchema } from '../../../../../lib/culture-server';

export const dynamic = 'force-dynamic';

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
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseNumber(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return trimmed;
}

function parseGenres(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const sanitized = value
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, 60) : ''))
    .filter(Boolean);
  return Array.from(new Set(sanitized));
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureCultureSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as CultureBody;

    const title = parseString(body.title, 200);
    const imageUrl = parseString(body.image_url, 400);
    const language = parseString(body.language, 80);
    const reviewText = parseString(body.review_text, 1200);
    const status = parseString(body.status, 40);
    const author = parseString(body.author, 160);
    const mood = parseString(body.mood, 80);

    const typeRaw = body.type === undefined ? undefined : typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
    const type = typeRaw === undefined ? undefined : VALID_TYPES.has(typeRaw) ? typeRaw : null;
    if (type === null) return NextResponse.json({ ok: false, message: 'Invalid type.' }, { status: 400 });

    const categoryKindRaw =
      body.category_kind === undefined
        ? undefined
        : typeof body.category_kind === 'string'
          ? body.category_kind.trim().toLowerCase()
          : '';
    const categoryKind =
      categoryKindRaw === undefined ? undefined : VALID_CATEGORY_KIND.has(categoryKindRaw) ? categoryKindRaw : null;

    const inWishlist = body.in_wishlist === undefined ? undefined : body.in_wishlist ? 1 : 0;
    const rating = parseNumber(body.rating);
    const dateStarted = parseDate(body.date_started);
    const dateCompleted = parseDate(body.date_completed);
    const seasonsWatched = parseNumber(body.seasons_watched);
    const episodesWatched = parseNumber(body.episodes_watched);
    const totalPages = parseNumber(body.total_pages);
    const pagesRead = parseNumber(body.pages_read);
    const parsedGenres = parseGenres(body.genres);
    const genresJson =
      parsedGenres === undefined
        ? undefined
        : JSON.stringify(
            (type === 'book' ? type : null) === 'book' && categoryKind === 'deen' ? [] : parsedGenres,
          );

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE culture_entries
      SET
        title = COALESCE(?, title),
        type = COALESCE(?, type),
        in_wishlist = COALESCE(?, in_wishlist),
        image_url = COALESCE(?, image_url),
        language = COALESCE(?, language),
        genres = COALESCE(?, genres),
        category_kind = COALESCE(?, category_kind),
        rating = COALESCE(?, rating),
        review_text = COALESCE(?, review_text),
        date_started = COALESCE(?, date_started),
        date_completed = COALESCE(?, date_completed),
        status = COALESCE(?, status),
        seasons_watched = COALESCE(?, seasons_watched),
        episodes_watched = COALESCE(?, episodes_watched),
        author = COALESCE(?, author),
        total_pages = COALESCE(?, total_pages),
        pages_read = COALESCE(?, pages_read),
        mood = COALESCE(?, mood)
      WHERE id = ?
      `,
      [
        title === undefined ? null : title,
        type === undefined ? null : type,
        inWishlist === undefined ? null : inWishlist,
        imageUrl === undefined ? null : imageUrl,
        language === undefined ? null : language,
        genresJson === undefined ? null : genresJson,
        categoryKind === undefined ? null : categoryKind,
        rating === undefined ? null : rating,
        reviewText === undefined ? null : reviewText,
        dateStarted === undefined ? null : dateStarted,
        dateCompleted === undefined ? null : dateCompleted,
        status === undefined ? null : status,
        seasonsWatched === undefined ? null : seasonsWatched,
        episodesWatched === undefined ? null : episodesWatched,
        author === undefined ? null : author,
        totalPages === undefined ? null : totalPages,
        pagesRead === undefined ? null : pagesRead,
        mood === undefined ? null : mood,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Entry not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update culture entry.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await ensureCultureSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM culture_entries WHERE id = ?`,
      [id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Entry not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete culture entry.' }, { status: 500 });
  }
}
