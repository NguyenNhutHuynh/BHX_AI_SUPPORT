<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bhx_products', function (Blueprint $table) {
            $table->id();
            $table->string('bhx_sku', 50)->unique();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->integer('category_id')->nullable()->index();
            $table->string('category_name', 100)->nullable()->index();
            $table->integer('price');
            $table->integer('original_price')->nullable();
            $table->string('unit_label', 50)->nullable();
            $table->boolean('in_stock')->default(true)->index();
            $table->boolean('is_cooking_ingredient')->default(true)->index();
            $table->float('net_weight_value')->nullable();
            $table->string('net_weight_unit', 20)->nullable();
            $table->string('image_url', 500)->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->fullText(['name', 'category_name']);
        });

        Schema::create('user_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->integer('daily_budget')->default(70000);
            $table->integer('meals_per_day')->default(2);
            $table->integer('servings')->default(1);
            $table->json('cookware')->nullable();
            $table->json('liked_foods')->nullable();
            $table->json('disliked_foods')->nullable();
            $table->timestamps();
        });

        Schema::create('user_pantries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('bhx_product_id')->constrained('bhx_products')->cascadeOnDelete();
            $table->float('remaining_value');
            $table->string('unit', 20);
            $table->date('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('meal_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('plan_date');
            $table->integer('total_estimated_cost');
            $table->json('shopping_list');
            $table->json('meals_data');
            $table->boolean('is_completed')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meal_plans');
        Schema::dropIfExists('user_pantries');
        Schema::dropIfExists('user_preferences');
        Schema::dropIfExists('bhx_products');
    }
};

