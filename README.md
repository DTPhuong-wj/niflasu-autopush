# NiFlasu AutoPush

create project NiFlasu with requirements. Auto push code on github with name: NiFlasu

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/836eefb8-7aa0-4769-8780-79d61580af63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Add a Google Drive MP3 to Listening

1. Upload the MP3 to Google Drive.
2. In Drive, open the file's **Share** menu and choose **Copy link**. Use the copied file link, for example: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`.

3. Make sure the people using the app have permission to access the file. For a restricted file, they must be signed in to an authorized Google account. If the file should be available to anyone with the link, set that explicitly in Drive; the app does not change sharing permissions.
4. In Listening, add a lesson, select **Google Drive**, paste the copied link, choose **Kiểm tra link**, fill in the lesson details, and save it.

The app stores the extracted Drive file ID, then builds the audio download URL and **Mở nguồn** link when needed. It does not change Drive sharing permissions. A link opening successfully in a new tab does not guarantee that Drive provides a stream the browser's audio player can play. If playback fails, use **Mở nguồn** or host the MP3 at a URL that serves audio directly.
