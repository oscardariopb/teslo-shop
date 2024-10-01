import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) { }

  async create(createProductDto: CreateProductDto) {

    try {
      // if (!createProductDto.slug) {
      //   createProductDto.slug = createProductDto.title.toLowerCase().replaceAll(' ', '_').replaceAll("'", "")
      // } else {
      //   createProductDto.slug = createProductDto.slug.toLowerCase().replaceAll(' ', '_').replaceAll("'", "")
      // }
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);

      return product;
    } catch (error) {
      this.handleExceptions(error)
    }

  }

  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit = 10, offset = 0 } = paginationDto;
      const products = await this.productRepository.find({
        take: limit,
        skip: offset
      });
      return products;
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
      const queryBuilder = this.productRepository.createQueryBuilder();
      product = await queryBuilder.where('UPPER(title) =:title or slug =:slug', {
        title: term.toUpperCase(),
        slug: term.toLowerCase()
      }).getOne();
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

  async update(id: string, updateProductDto: UpdateProductDto) {

    const product = await this.productRepository.preload({
      id,
      ...updateProductDto
    });

    if (!product) throw new NotFoundException(`Product with id: ${id} not found`);
    try {
      await this.productRepository.save(product);
      return product;

    } catch (error) {
      this.handleExceptions(error)
    }
  }

  async remove(id: string) {
    try {
      const product = await this.findOne(id);

      const res = await this.productRepository.delete({ id }); //findBy({ id });
      return res;
    } catch (error) {
      this.handleExceptions(error)
    }
  }

  private handleExceptions(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail)
    }
    this.logger.error(error)

    throw new InternalServerErrorException('Unexpected Error, check logs')
  }
}
