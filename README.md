# Stremio Private Cloud

Your personal media library inside Stremio — like having your own Plex, but integrated directly into Stremio.

Stremio Private Cloud lets you combine your local video files, Google Drive links, and future storage providers into one private library that shows up right inside Stremio alongside your other addons. Everything runs locally on your computer, on your network, under your control.

## What it does

- **Add movies and series** by searching the Cinemeta database — posters, descriptions, and episode lists are fetched automatically
- **Link your files** from your computer or from Google Drive shared links
- **Stream to any Stremio** on your local network — desktop, mobile, TV, browser
- **Manage everything** from a modern web dashboard

No cloud accounts needed. No subscriptions. Your files, your network, your library.

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-user/stremio-private-cloud.git
cd stremio-private-cloud
npm install

# Install and build the frontend
cd frontend && npm install && npm run build && cd ..

# Start the server
npm start
```

The server will display two URLs:

```
Admin UI:     https://192-168-x-x.local-ip.medicmobile.org:11780/admin
Addon URL:    https://192-168-x-x.local-ip.medicmobile.org:11780/manifest.json
```

## How to use

### 1. Open the Admin UI

Go to the Admin UI URL in your browser. This is where you manage your library.

### 2. Add content

Click **"+ Add Content"**, search for a movie or series, and click **"+ Add"**. The metadata (poster, title, episodes) is loaded automatically.

### 3. Link your files

Click on any item in your library, then click **"+ Add File"**. You'll be asked how you want to add the file:

- **Local File** — Select a video file from your computer using the standard file picker
- **Google Drive** — Paste a shared Google Drive link (the file must be shared as "Anyone with the link")

For series, you can link a file to each individual episode.

### 4. Install the addon in Stremio

Copy the **Addon URL** and paste it in Stremio:

**Settings > Addons > Install from URL**

Your private library will appear as a new catalog in Stremio. Any device on your network can install the addon and access your library.

## Accessing from other devices

Any device on the same network can access both the Admin UI and the Stremio addon. The HTTPS certificate is valid publicly, so there are no browser warnings.

## Support

If you find this project useful and want to support its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/himandrobot)

## License

MIT
