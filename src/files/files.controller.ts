import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { fileNamer, fileFilter } from './helpers';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: ConfigService
  ) { }

  @Get('product/:imageName')
  findProductImage(@Param('imageName') imageName: string, @Res() res: Response) {
    const path = this.filesService.getStaticProductImage(imageName);
    //return path;
    res.sendFile(path);
    // res.status(403).json({
    //   ok: false,
    //   path
    // })
  }

  @Post('product')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: fileFilter,
    // limits: { fileSize: 1000000}
    storage: diskStorage({ destination: './static/product', filename: fileNamer })
  }))
  uploadProductImage(@UploadedFile() file: Express.Multer.File) {

    if (!file) {
      throw new BadRequestException('make sure the file is an image')
    }
    console.log({ file });
    // const secureUrl = `${file.filename}`;
    const secureUrl = `${this.configService.get('HOST_API')}/files/product/${file.filename}`;
    return { secureUrl }; // archivo a subir a otro lugar

  }
}
