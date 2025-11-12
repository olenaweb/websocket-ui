import * as fs from "fs";
import * as path from "path";
import * as http from "http";
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
export const httpServer = http.createServer((req, res) => {
    const __dirname = path.resolve(path.dirname(""));
    const file_path = __dirname + (req.url === "/" ? "/front/index.html" : "/front" + req.url);
    fs.readFile(file_path, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        const contentType = getContentType(file_path);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});
