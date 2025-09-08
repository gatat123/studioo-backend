import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initializeSocketServer } from "./lib/socket/server";
import { initializeStorage } from "./lib/storage";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    console.log("🚀 Studio Backend Server 시작 중...");
    
    // Storage 디렉토리 초기화
    initializeStorage();
    console.log("✅ Storage 디렉토리 초기화 완료");
    
    // Next.js 앱 준비
    await app.prepare();
    console.log("✅ Next.js 앱 준비 완료");

    // HTTP 서버 생성
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Request handling error:", err);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    });

    // Socket.io 서버 초기화
    const socketServer = initializeSocketServer(server);
    console.log("✅ Socket.io 서버 초기화 완료");

    // 서버 시작
    server.listen(port, () => {
      console.log(`🌟 Studio Backend Server가 http://${hostname}:${port}에서 실행 중입니다`);
      console.log(`📡 Socket.io 서버가 포트 ${port}에서 실행 중입니다`);
      
      if (dev) {
        console.log("🔧 개발 모드로 실행 중");
        console.log(`📊 API 상태: http://${hostname}:${port}/api/socket`);
      }
    });

    // 서버 종료 처리
    process.on("SIGTERM", () => {
      console.log("🛑 SIGTERM 신호 수신, 서버 종료 중...");
      server.close(() => {
        console.log("✅ 서버가 정상적으로 종료되었습니다");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("🛑 SIGINT 신호 수신, 서버 종료 중...");
      server.close(() => {
        console.log("✅ 서버가 정상적으로 종료되었습니다");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("❌ 서버 시작 실패:", error);
    process.exit(1);
  }
}

// 처리되지 않은 예외 처리
process.on("uncaughtException", (error) => {
  console.error("❌ 처리되지 않은 예외:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ 처리되지 않은 Promise 거부:", reason, "at:", promise);
  process.exit(1);
});

// 서버 시작
startServer().catch((error) => {
  console.error("❌ 서버 시작 중 오류 발생:", error);
  process.exit(1);
});

export default startServer;