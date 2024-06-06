const axios = require("axios");
const ytdl = require("@neoxr/ytdl-core");
const yts = require("yt-search");
const fs = require("fs-extra");

module.exports = {
  config: {
    name: "sing",
    version: "2.0",
    author: "Abdul Kaiyum",
    category: "music",
    role: 0,
  },

  annieStart: async function({ bot, msg, match }) {
    const chatId = msg.chat.id;
    const query = match[1];

    try {
      if (query.toLowerCase() === "playlist") {
        // Display playlist options
        await this.showPlaylistOptions(bot, chatId);
      } else if (query.toLowerCase().startsWith("lyrics")) {
        // Fetch lyrics
        const songName = query.slice(7).trim();
        if (!songName) {
          return bot.sendMessage(chatId, "Please provide a song name for lyrics.");
        }
        await this.fetchLyrics(bot, chatId, songName);
      } else {
        // Search for the song
        const searchResults = await yts(query);
        if (searchResults.videos.length === 0) {
          return bot.sendMessage(chatId, "❌ No videos found for that song.");
        }

        const buttons = searchResults.videos.map((video, index) => ({
          text: `${index + 1}. ${video.title}`,
          callback_data: JSON.stringify({ action: 'select_track', index })
        }));

        await bot.sendMessage(chatId, "Select a video:", {
          reply_markup: {
            inline_keyboard: buttons.map(button => [button])
          }
        });
      }
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "❌ An error occurred while processing your request.");
    }
  },

  async selectTrack({ bot, msg, match }) {
    const chatId = msg.chat.id;
    const userId = msg.from.id; 
    const { index } = match;

    try {
      const searchResults = await yts(match[1]);
      if (searchResults.videos.length === 0) {
        return bot.sendMessage(chatId, "❌ No videos found for that song.");
      }

      const video = searchResults.videos[index];
      const videoUrl = video.url;

      const stream = ytdl(videoUrl, { filter: "audioonly" });
      const fileName = `${video.title}.mp3`;
      const filePath = `./cache/${fileName}`;

      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);

      writeStream.on('finish', async () => {
        const fileStats = fs.statSync(filePath);
        if (fileStats.size > 25 * 1024 * 1024) {
          fs.unlinkSync(filePath);
          return bot.sendMessage(chatId, "❌ The song is too large to send (>25MB).");
        }

        const caption = `Title: ${video.title}\nDuration: ${video.timestamp}\nYouTube Link: ${videoUrl}`;
        const audio = fs.createReadStream(filePath);

        await bot.sendAudio(chatId, audio, { caption });

        fs.unlinkSync(filePath);
      });

      writeStream.on('error', async (error) => {
        console.error('[WRITE STREAM ERROR]', error);
        await bot.sendMessage(chatId, '❌ Failed to write audio file.');
      });
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, "❌ An error occurred while processing the selected track.");
    }
  },

  async showPlaylistOptions(bot, chatId) {
    try {
      const playlists = await this.getPlaylists();
      const userPlaylist = playlists[chatId] || [];

      if (userPlaylist.length === 0) {
        return bot.sendMessage(chatId, "Your playlist is empty.");
      }

      const buttons = userPlaylist.map((track, index) => ({
        text: `${index + 1}. ${track}`,
        callback_data: JSON.stringify({ action: 'play_playlist_track', index })
      }));

      await bot.sendMessage(chatId, "Select a track from your playlist:", {
        reply_markup: {
          inline_keyboard: buttons.map(button => [button])
        }
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "❌ An error occurred while fetching your playlist.");
    }
  },

  async getPlaylists() {
    try {
      const playlistsData = await fs.readFile("playlists.json", "utf8");
      return JSON.parse(playlistsData);
    } catch (error) {
      return {};
    }
  },

  async fetchLyrics(bot, chatId, songName) {
    try {
      const apiUrl = `https://lyrist-woad.vercel.app/api/${encodeURIComponent(songName)}`;
      const response = await axios.get(apiUrl);

      if (response.data.lyrics) {
        await bot.sendMessage(chatId, `🎵 Lyrics for "${response.data.title}" by ${response.data.artist}:\n\n${response.data.lyrics}`);
      } else {
        await bot.sendMessage(chatId, "❌ No lyrics found for that song.");
      }
    } catch (error) {
      console.error("Error fetching lyrics:", error);
      await bot.sendMessage(chatId, "❌ An error occurred while fetching the lyrics.");
    }
  },
};