<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BhxCategory extends Model
{
    use HasFactory;

    protected $table = 'bhx_categories';

    protected $fillable = [
        'slug',
        'name',
        'url',
        'is_food_category',
        'last_scraped_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_food_category' => 'boolean',
            'last_scraped_at' => 'datetime',
        ];
    }
}

