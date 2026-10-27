// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
exports.isAdminSender = (event, contents, origin) => {
  try {
    return Boolean(contents && event.sender === contents && event.senderFrame === contents.mainFrame
      && new URL(event.senderFrame.url).origin === origin);
  } catch { return false; }
};
