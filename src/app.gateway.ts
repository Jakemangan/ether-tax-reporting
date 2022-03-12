import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'http';

@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    handleDisconnect(client: any) {
        // throw new Error('Method not implemented.');
    }
    handleConnection(client: any, ...args: any[]) {
        console.log('New client connected.');
    }
    afterInit(server: any) {
        // throw new Error('Method not implemented.');
    }
    // @SubscribeMessage('message')
    // handleMessage(client: any, payload: any): string {
    // }
}
