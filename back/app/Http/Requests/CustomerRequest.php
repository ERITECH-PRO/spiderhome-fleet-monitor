<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

use Illuminate\Validation\Rule;

class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');
        $customer = $this->route('customer');
        $customerId = $customer instanceof \App\Models\Customer ? $customer->id : (is_numeric($customer) ? (int)$customer : null);

        return [
            'name'           => ($isUpdate ? 'sometimes' : 'required') . '|string|max:255',
            'server_address' => 'nullable|string|max:255',
            'email'          => ['nullable', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($customerId)],
            'phone'          => ['nullable', 'string', 'max:50', Rule::unique('customers', 'phone')->ignore($customerId)],
            'status'  => 'nullable|string|in:active,inactive,prospect,suspended',
            'notes'   => 'nullable|string',
            'address' => 'nullable|string|max:500',
            'city'    => 'nullable|string|max:100',
            'country' => 'nullable|string|max:3',
            'siret'   => 'nullable|string|max:20',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'  => 'Le nom du client est obligatoire.',
            'email.email'    => 'L\'adresse email n\'est pas valide.',
            'status.in'      => 'Le statut doit être : active, inactive, prospect ou suspended.',
        ];
    }
}
