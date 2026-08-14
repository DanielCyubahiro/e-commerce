export class ListProductsQuery {
  constructor(
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
  ) {}
}
