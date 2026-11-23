# Multiple-image test inputs (#221 / #222 / #223)

These input files are repository fixtures, not files published by the application
build. The task board uses the display names below; downloaded files retain their
actual extensions. Use the same bytes for frontend and backend tests.

| Board attachment display name | Repository file | Bytes |
| --- | --- | ---: |
| desklamp-front | tests/fixtures/listing-images/desklamp-front.jpg | 46,162 |
| desklamp-side | tests/fixtures/listing-images/desklamp-side.webp | 94,986 |
| desklamp-back | tests/fixtures/listing-images/desklamp-back.png | 195,897 |
| desklamp-angled | tests/fixtures/listing-images/desklamp-angled.jpg | 52,329 |
| desklamp-bottom | tests/fixtures/listing-images/desklamp-bottom.png | 173,257 |
| desklamp-top | tests/fixtures/listing-images/desklamp-top.webp | 68,204 |
| invalid-file | tests/fixtures/listing-images/invalid-file.txt | 53 |
| oversized-listing-photo-over | tests/fixtures/listing-images/STK_Shot16_00000.png | 11,285,981 |

The six desklamp files are the user-supplied listing photographs and format
variants. `invalid-file.txt` is unsupported plain text. The oversized file is the
unmodified NASA SVS PNG at:

https://svs.gsfc.nasa.gov/vis/a020000/a020200/a020286/frames/3840x2160_16x9_60p/Shot16/STK_Shot16/STK_Shot16_00000.png

Credit: NASA Scientific Visualization Studio. Keep the original PNG bytes;
screenshots or optimized previews may fall below the application's 5 MiB limit.
`manifest.json` records exact byte counts and SHA-256 values for all eight files.

The board only accepts file uploads up to 1 MB. Upload the seven small files and
use **Paste Web Link** for `oversized-listing-photo-over`, pointing to the NASA
original or a verified repository download of this exact fixture.

Frontend selection checks reject the large file without uploading. The backend
multipart case needs `post_max_size >= 16M` to reach the endpoint. Keeping
`upload_max_filesize >= 16M` lets the application perform its own size check;
the application's accepted maximum remains 5,242,880 bytes.

Each publication test deletes only the listing it created, using its actual ID
or the exact temporary title under the verified seller account. Do not delete
shared Sprint 3 items or alter membership to manufacture permission results.
