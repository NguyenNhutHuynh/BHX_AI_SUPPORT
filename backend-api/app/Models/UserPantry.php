<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPantry extends Model
{
    use HasFactory;

    protected $table = 'user_pantries';

    protected $fillable = [
        'user_id',
        'bhx_product_id',
        'remaining_value',
        'unit',
        'expires_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'bhx_product_id' => 'integer',
            'remaining_value' => 'float',
            'expires_at' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(BhxProduct::class, 'bhx_product_id');
    }
}

