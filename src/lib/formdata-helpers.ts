export class FormDataRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormDataRequestError';
  }
}

export async function readMultipartFormData(request: Request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    throw new FormDataRequestError('Expected multipart/form-data request.');
  }

  try {
    return await request.formData();
  } catch {
    throw new FormDataRequestError('Invalid multipart form data.');
  }
}
