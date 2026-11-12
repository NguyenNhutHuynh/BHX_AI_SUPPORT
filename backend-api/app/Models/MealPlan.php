<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealPlan extends Model
{
    use HasFactory;

    protected $table = 'meal_plans';

    protected $fillable = [
        'user_id',
        'plan_date',
        'total_estimated_cost',
        'shopping_list',
        'meals_data',
        'is_completed',
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
            'plan_date' => 'date',
            'total_estimated_cost' => 'integer',
            'shopping_list' => 'array',
            'meals_data' => 'array',
            'is_completed' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

