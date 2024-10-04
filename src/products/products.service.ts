import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product, ProductImage } from './entities';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { url } from 'inspector';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly dataSource: DataSource,
  ) { }

  async create(createProductDto: CreateProductDto) {

    try {
      // if (!createProductDto.slug) {
      //   createProductDto.slug = createProductDto.title.toLowerCase().replaceAll(' ', '_').replaceAll("'", "")
      // } else {
      //   createProductDto.slug = createProductDto.slug.toLowerCase().replaceAll(' ', '_').replaceAll("'", "")
      // }
      const { images = [], ...productDetails } = createProductDto;
      const product = this.productRepository.create({ ...productDetails, images: images.map(image => this.productImageRepository.create({ url: image })) });
      await this.productRepository.save(product);

      return { ...product, images };
    } catch (error) {
      this.handleExceptions(error)
    }

  }

  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit = 10, offset = 0 } = paginationDto;
      const products = await this.productRepository.find({
        take: limit,
        skip: offset,
        relations: {
          images: true
        }
      });
      // return products;
      return products.map(product => ({
        ...product,
        images: product.images.map(img => img.url)
      }));
    } catch (error) {
      this.handleExceptions(error)
    }
  }

  async findOne(term: string) {
    // try {
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      // product = await this.productRepository.findOneBy({ slug: term });
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder.where('UPPER(title) =:title or slug =:slug', {
        title: term.toUpperCase(),
        slug: term.toLowerCase()
      })
        .leftJoinAndSelect('prod.images', 'prodImages') //para obtener las relaciones si usas queryBuilder
        .getOne();
    }

    // const product = await this.productRepository.findOneBy({ id }); //findBy({ id });
    console.log(product)
    if (!product) {
      throw new NotFoundException(`Product with ${term} not found`);
    }
    return product;
    // } catch (error) {
    //   this.handleExceptions(error)
    // }

  }

  async findOnePlain(term: string) {
    const { images = [], ...rest } = await this.findOne(term);
    return {
      ...rest, images: images.map(img => img.url)
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {

    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({ id, ...toUpdate });

    if (!product) throw new NotFoundException(`Product with id: ${id} not found`);

    // query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      if (images?.length) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });
        product.images = images.map(img => this.productImageRepository.create({ url: img }));
      } else {

      }
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      //await this.productRepository.save(product);
      //return product;
      return this.findOnePlain(id); // fácil reutiliza código

    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleExceptions(error);
    }

    /*
    const product = await this.productRepository.preload({
      id,
      ...updateProductDto
    });

    if (!product) throw new NotFoundException(`Product with id: ${id} not found`);
    try {
      await this.productRepository.save(product);
      return product;
   */
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    const res = await this.productRepository.remove(product); //findBy({ id }); delete se usa y es más rápido delete({id})
    return res;
  }

  private handleExceptions(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail)
    }
    this.logger.error(error)

    throw new InternalServerErrorException('Unexpected Error, check logs')
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');
    try {
      return await query.delete().where({}).execute();
    } catch (error) {
      this.handleExceptions(error);
    }
  }
}
