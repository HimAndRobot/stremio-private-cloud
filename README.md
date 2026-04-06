# Stremio Private Cloud

Your personal media library inside Stremio — like having your own Plex, but integrated directly into Stremio.

Stremio Private Cloud lets you combine your local video files, Google Drive, MEGA, Telegram, YouTube and other sources into one private library that shows up right inside Stremio alongside your other addons. Everything runs locally on your computer, on your network, under your control.

## What it does

- **Add movies and series** by searching the Cinemeta database — posters, descriptions, and episode lists are fetched automatically
- **Multiple file sources** — Upload files, link local paths, Google Drive, MEGA, Telegram, and YouTube
- **Bulk import** — Add multiple episodes at once by pasting links
- **Organize with folders** — Create folders, drag & drop content between them
- **Stream to any Stremio** on your local network — desktop, mobile, TV, browser
- **Manage everything** from a modern web dashboard

No cloud accounts needed. No subscriptions. Your files, your network, your library.

## Quick Start

```bash
# Clone and install
git clone https://github.com/HimAndRobot/stremio-private-cloud.git
cd stremio-private-cloud
npm install

# Install and build the frontend
cd frontend && npm install && npm run build && cd ..

# Start the server
npm start
```

### Docker

```bash
git clone https://github.com/HimAndRobot/stremio-private-cloud.git
cd stremio-private-cloud
docker compose up -d --build
```

The server will show the Admin URL in the console. Open the Admin UI in your browser to see the correct Addon URL for your network.

## How to use

### 1. Open the Admin UI

Open the Admin URL in your browser. The Addon URL with copy and install buttons is displayed at the top.

### 2. Add content

Click **"+ Add Content"**, search for a movie or series, and click **"+ Add"**. The metadata (poster, title, episodes) is loaded automatically. Use the type and year filters to find what you need.

### 3. Add files

Click on any item in your library, then click **"+ Add File"**. Choose your source:

- **Upload File** — Select a video file from your computer to upload to the server
- **Link File** — Link a file path already on the server
- **Google Drive** — Paste a shared Google Drive link
- **MEGA** — Paste a MEGA.nz shared link
- **YouTube** — Paste a YouTube video link
- **Telegram** — Paste a Telegram message link (requires setup in Settings)

For series, you can add files per episode or use **Bulk Import** to add multiple episodes at once.

### 4. Organize with folders

Create folders to organize your library. Drag and drop content and folders to rearrange. Use the filter button to search and filter within each folder.

### 5. Install the addon in Stremio

Use the **Install** or **Copy** button at the top of the Admin UI, then paste the URL in Stremio:

**Settings > Addons > Install from URL**

Any device on your network can install the addon and access your library.

## Telegram Setup

To use Telegram as a file source:

1. Go to **Settings > Integrations > Telegram**
2. Create an app at [my.telegram.org/apps](https://my.telegram.org/apps) to get your API credentials
3. Save the API ID and API Hash
4. Login with your phone number and verification code

Once connected, you can paste Telegram message links containing video files.

## Accessing from other devices

Any device on the same network can access both the Admin UI and the Stremio addon. The HTTPS certificate is valid publicly, so there are no browser warnings.

## Support

If you find this project useful and want to support its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/himandrobot)

## License

MIT
