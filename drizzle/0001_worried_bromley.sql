ALTER TABLE "products" ALTER COLUMN "sku" SET DATA TYPE varchar(50);--> statement-breakpoint
CREATE INDEX "products_price_amount_idx" ON "products" USING btree ("price_amount");--> statement-breakpoint
CREATE INDEX "products_created_at_id_idx" ON "products" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "low_stock_threshold";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_active";