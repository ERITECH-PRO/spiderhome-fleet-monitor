<?php

namespace App\Http\Requests;

use App\Models\ServiceRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'site_id'     => ['nullable', 'integer', 'exists:sites,id'],
            'device_id'   => ['nullable', 'integer', 'exists:devices,id'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'title'       => ['sometimes', 'string', 'max:255'],
            'reason'      => ['nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:5000'],
            'priority'    => ['nullable', Rule::in(ServiceRequest::PRIORITIES)],
            'status'      => ['nullable', Rule::in(ServiceRequest::STATUSES)],
            'desired_at'  => ['nullable', 'date'],
            'comment'     => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'priority.in' => 'Priorité invalide. Valeurs acceptées : critical, high, normal, low.',
            'status.in'   => 'Statut invalide.',
        ];
    }
}
