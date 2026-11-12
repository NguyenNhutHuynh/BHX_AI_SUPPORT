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
        Schema::create('bhx_categories', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 150)->unique();
            $table->string('name', 150)->nullable();
            $table->string('url', 255);
            $table->boolean('is_food_category')->default(false)->index();
            $table->timestamp('last_scraped_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bhx_categories');
    }
};

