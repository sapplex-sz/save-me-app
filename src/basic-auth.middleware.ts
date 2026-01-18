import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 强制拦截 /admin 下的所有请求，包括 index
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).send('Authentication required');
    }

    try {
      const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
      const user = auth[0];
      const pass = auth[1];

      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPass = process.env.ADMIN_PASS || 'saveme2026';

      if (user === adminUser && pass === adminPass) {
        next();
      } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('Invalid credentials');
      }
    } catch (e) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).send('Authentication failed');
    }
  }
}
