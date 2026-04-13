import { PrismaService } from "database/prisma.service";
import { PrismaModule } from "database/database.module";
import { Module,forwardRef } from "@nestjs/common";
import { WalletModule } from "src/wallet/wallet.module";
import { VendorController } from "./vendor.controller";
import { VendElectricityDto } from "./dto/vend-electricity.dto";
import { VendorService } from "./vendor.service";
import { VendorAdapter } from "./vendor.adaptor";

@Module({
    imports:[
        PrismaModule,
        forwardRef(()=>WalletModule),
    ],
    controllers:
    [VendorController],
    providers:
    [VendorService,VendorAdapter],
    exports:
    [VendorService],
})
export class VendorModule {}