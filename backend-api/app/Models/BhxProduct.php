<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BhxProduct extends Model
{
    use HasFactory;

    protected $table = 'bhx_products';

    protected $fillable = [
        'bhx_sku',
        'name',
        'slug',
        'category_id',
        'category_name',
        'price',
        'original_price',
        'unit_label',
        'in_stock',
        'is_cooking_ingredient',
        'net_weight_value',
        'net_weight_unit',
        'image_url',
        'last_synced_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'price' => 'integer',
            'original_price' => 'integer',
            'in_stock' => 'boolean',
            'is_cooking_ingredient' => 'boolean',
            'net_weight_value' => 'float',
            'last_synced_at' => 'datetime',
        ];
    }

    public function userPantries(): HasMany
    {
        return $this->hasMany(UserPantry::class, 'bhx_product_id');
    }
}

