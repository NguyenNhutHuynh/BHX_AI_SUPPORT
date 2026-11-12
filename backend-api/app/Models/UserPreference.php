<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    use HasFactory;

    protected $table = 'user_preferences';

    protected $fillable = [
        'user_id',
        'daily_budget',
        'meals_per_day',
        'servings',
        'cookware',
        'liked_foods',
        'disliked_foods',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'daily_budget' => 'integer',
            'meals_per_day' => 'integer',
            'servings' => 'integer',
            'cookware' => 'array',
            'liked_foods' => 'array',
            'disliked_foods' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

