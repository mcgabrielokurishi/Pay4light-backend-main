import { Module } from "@nestjs/common";
import { ChatMemoryService } from "src/pay4light-AI/chat-memory.service";

@Module({
    providers:
    [ChatMemoryService],
    exports:
    [ChatMemoryService]
})
export class ChatMemoryModule{}