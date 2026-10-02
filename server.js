const { createServer } = require("http");
const next = require("next");

const port = Number(process.env.PORT || 3000);
const dev = process.env.NEXT_DEV === "true";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => {
    handle(request, response);
  }).listen(port, () => {
    console.log(`Ready on port ${port}`);
  });
});
