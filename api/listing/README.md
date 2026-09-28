# Listing image API

This folder contains the backend used by listing-related task cards. Card #111
adds the image storage and delivery layer. Later listing endpoints can reuse
`store_listing_image()` instead of implementing a second upload path.

## Upload an image

Send a `POST` request to `api/listing/upload_image.php` as
`multipart/form-data`. The file field must be named `image`.

Accepted formats are JPEG, PNG, and WebP. The maximum size is 5 MB. A successful
request returns HTTP `201` with an `image_url` that can be stored with a listing.
The server detects the file's real MIME type and does not trust the client
filename or extension.

## Retrieve an image

Send a `GET` or `HEAD` request to the `image_url` returned by the upload. The
endpoint only accepts server-generated filenames and does not expose arbitrary
filesystem paths.

## Server requirement

The PHP process must have permission to create and write to
`uploads/listings/`. Uploaded files are ignored by Git; only the directory's
`.gitignore` is committed.
