import { Body, Controller, Post } from '@nestjs/common';
import { DatabaseRepo } from 'src/services/database/db-repo/db.repo';

@Controller('waitinglist')
export class WaitinglistController {
    constructor(private dbRepo: DatabaseRepo) {}

    @Post()
    postEmail(@Body() body) {
        this.dbRepo.insertWaitingListEmail(body.email);
    }
}
